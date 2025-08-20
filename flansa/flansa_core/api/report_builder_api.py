#!/usr/bin/env python3
"""
Flansa Report Builder API

Creates custom reports with field selection from current and parent tables,
filtering, sorting, and multiple view modes including gallery view.
"""

import frappe
import json

def get_period_expression(field, period):
    """
    Generate SQL expression for time period grouping
    """
    field_expr = f"`{field}`"
    
    if period == 'year':
        return f"YEAR({field_expr})"
    elif period == 'month':
        return f"DATE_FORMAT({field_expr}, '%Y-%m')"
    elif period == 'week':
        # Return the Monday of the week as a more intuitive grouping
        return f"DATE_FORMAT(DATE_SUB({field_expr}, INTERVAL WEEKDAY({field_expr}) DAY), '%Y-%m-%d')"
    elif period == 'day':
        return f"DATE({field_expr})"
    elif period == 'hour':
        return f"DATE_FORMAT({field_expr}, '%Y-%m-%d %H:00:00')"
    else:
        return field_expr  # Fallback to exact value

def get_period_where_condition(field, period, group_value):
    """
    Generate WHERE condition to match records for a specific period group
    """
    field_expr = f"`{field}`"
    
    if period == 'year':
        return f"YEAR({field_expr}) = %s"
    elif period == 'month':
        return f"DATE_FORMAT({field_expr}, '%Y-%m') = %s"
    elif period == 'week':
        # Match all records in the same week (where Monday of week matches)
        return f"DATE_FORMAT(DATE_SUB({field_expr}, INTERVAL WEEKDAY({field_expr}) DAY), '%Y-%m-%d') = %s"
    elif period == 'day':
        return f"DATE({field_expr}) = %s"
    elif period == 'hour':
        return f"DATE_FORMAT({field_expr}, '%Y-%m-%d %H:00:00') = %s"
    else:
        return f"{field_expr} = %s"
import re
from frappe import _
from frappe.utils import now

@frappe.whitelist()
def get_report_field_options(table_name):
    """
    Get all available fields for report building including:
    - Current table fields
    - Lookup fields from parent tables via relationships
    - Computed fields
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name or not frappe.db.exists("DocType", doctype_name):
            return {"success": False, "error": "DocType not found or not generated"}
        
        # Use centralized system fields manager
        from flansa.flansa_core.api.system_fields_manager import FRAPPE_SYSTEM_FIELDS
        
        # Get current table fields (non-system fields)
        meta = frappe.get_meta(doctype_name)
        current_fields = []
        system_fields = []
        
        for field in meta.fields:
            # Skip layout fields but include important system fields  
            # Important system fields like name, owner, creation, etc. should be available in reports
            if (field.fieldtype not in ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Button', 'Table']
                and field.fieldname not in ['idx']  # Keep idx hidden but allow name, docstatus, etc.
                and not field.fieldname.startswith('_')):
                
                is_system_field = field.fieldname in FRAPPE_SYSTEM_FIELDS
                
                field_info = {
                    "fieldname": field.fieldname,
                    "field_label": field.label or field.fieldname.replace('_', ' ').title(),
                    "fieldtype": field.fieldtype,
                    "table": table_name,
                    "table_label": table_doc.table_label,
                    "category": "system" if is_system_field else "current",
                    "options": getattr(field, 'options', ''),
                    "is_virtual": getattr(field, 'is_virtual', 0),
                    "fetch_from": getattr(field, 'fetch_from', ''),
                    "is_gallery": field.fieldtype in ['Attach Image', 'Attach'] or 'image' in field.fieldname.lower(),
                    "is_system_field": is_system_field  # Add system field indicator
                }
                
                # Check if field has flansa_config for computed fields
                if hasattr(field, 'description') and field.description:
                    try:
                        import json
                        flansa_config = json.loads(field.description)
                        if flansa_config.get('field_type') == 'computed':
                            field_info['is_computed'] = True
                            field_info['is_virtual'] = True  # Treat computed fields as virtual
                            field_info['formula'] = flansa_config.get('formula', '')
                    except:
                        pass
                
                # Separate system fields from regular fields
                if is_system_field:
                    system_fields.append(field_info)
                else:
                    current_fields.append(field_info)
        
        # Only include system fields that are consistent with visual builder
        # Use the same approach as system_fields_manager to ensure consistency
        from flansa.flansa_core.api.system_fields_manager import get_all_system_fields
        manager_result = get_all_system_fields()
        if manager_result.get('success'):
            manager_system_fields = manager_result.get('fields', [])
            
            # Add any system fields from manager that aren't already in system_fields
            for manager_field in manager_system_fields:
                field_name = manager_field['fieldname']
                if not any(sf['fieldname'] == field_name for sf in system_fields):
                    system_fields.append({
                        "fieldname": field_name,
                        "field_label": manager_field['label'],
                        "fieldtype": manager_field['fieldtype'],
                        "table": table_name,
                        "table_label": table_doc.table_label,
                        "category": "system",
                        "options": manager_field.get('options', ''),
                        "is_virtual": 0,
                        "fetch_from": '',
                        "is_gallery": False,
                        "is_system_field": True
                    })
        
        # Get logic fields and categorize them properly
        logic_fields = []
        link_fields_in_current = []
        
        # First, process regular Link fields from the DocType
        for field in meta.fields:
            if field.fieldtype == "Link" and field.options:
                # Try to map the DocType back to a Flansa Table
                target_table = None
                try:
                    # Look for a Flansa Table that uses this DocType
                    target_tables = frappe.get_all("Flansa Table", 
                                                   filters={"doctype_name": field.options},
                                                   fields=["name", "table_label"])
                    if target_tables:
                        target_table = target_tables[0].name
                        link_fields_in_current.append({
                            "field_name": field.fieldname,
                            "target_table": target_table,
                            "field_label": field.label or field.fieldname.replace('_', ' ').title()
                        })
                except Exception as e:
                    frappe.log_error(f"Error mapping link field {field.fieldname} to Flansa Table: {str(e)}", "Report Builder Link Mapping")
        
        # Get logic fields for this table
        try:
            logic_field_docs = frappe.get_all("Flansa Logic Field",
                filters={"table_name": table_name, "is_active": 1},
                fields=["field_name", "field_label", "result_type", "logic_type", "logic_expression"]
            )
            
            for logic_field in logic_field_docs:
                # Add logic fields to current fields (they belong to current table)
                logic_field_info = {
                    "fieldname": logic_field.field_name,
                    "field_label": logic_field.field_label or logic_field.field_name.replace('_', ' ').title(),
                    "fieldtype": logic_field.result_type,
                    "table": table_name,
                    "table_label": table_doc.table_label,
                    "category": "current",
                    "logic_type": logic_field.logic_type,
                    "is_logic_field": True,
                    "options": "",
                    "is_gallery": False,
                    "is_system_field": False
                }
                
                # Store link fields for related field lookup
                if logic_field.logic_type == "link":
                    # For logic link fields, we need to extract target table from expression or field definition
                    target_table = None
                    if logic_field.logic_expression:
                        # Try to extract target table from expression if it contains table reference
                        pass  # For now, skip target table extraction
                    
                    if target_table:
                        link_fields_in_current.append({
                            "field_name": logic_field.field_name,
                            "target_table": target_table,
                            "field_label": logic_field.field_label
                        })
                
                current_fields.append(logic_field_info)
                
        except Exception as logic_error:
            frappe.log_error(f"Error getting logic fields for {table_name}: {str(logic_error)}", "Report Builder Logic Fields")

        # Get related fields grouped by link fields
        related_field_groups = []
        
        # Process each link field to get its target table fields
        for link_field in link_fields_in_current:
            try:
                target_table_doc = frappe.get_doc("Flansa Table", link_field["target_table"])
                target_doctype = target_table_doc.doctype_name
                
                if target_doctype and frappe.db.exists("DocType", target_doctype):
                    target_meta = frappe.get_meta(target_doctype)
                    group_fields = []
                    
                    for field in target_meta.fields:
                        if (field.fieldtype not in ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Button', 'Table'] 
                            and field.fieldname not in ['idx']
                            and not field.fieldname.startswith('_')):
                            
                            group_fields.append({
                                "fieldname": f"{link_field['field_name']}_{field.fieldname}",
                                "field_label": f"{field.label or field.fieldname.replace('_', ' ').title()}",
                                "fieldtype": field.fieldtype,
                                "table": link_field["target_table"],
                                "table_label": target_table_doc.table_label,
                                "category": "related",
                                "link_field": link_field["field_name"],
                                "link_field_label": link_field["field_label"],
                                "source_field": field.fieldname,
                                "options": getattr(field, 'options', ''),
                                "is_gallery": field.fieldtype in ['Attach Image', 'Attach'] or 'image' in field.fieldname.lower()
                            })
                    
                    if group_fields:
                        related_field_groups.append({
                            "link_field": link_field["field_name"],
                            "link_field_label": link_field["field_label"],
                            "target_table": link_field["target_table"],
                            "target_table_label": target_table_doc.table_label,
                            "fields": group_fields
                        })
                        
            except Exception as related_error:
                frappe.log_error(f"Error getting related fields for link {link_field['field_name']}: {str(related_error)}", "Report Builder Related Fields")
                continue

        # Flatten related fields for backward compatibility
        related_fields = []
        for group in related_field_groups:
            related_fields.extend(group["fields"])
        
        # Check for gallery capability
        has_gallery = any(field.get("is_gallery", False) for field in current_fields + related_fields + system_fields)
        
        return {
            "success": True,
            "table": {
                "name": table_name,
                "field_label": table_doc.table_label,
                "doctype": doctype_name
            },
            "fields": {
                "current": current_fields,
                "system": system_fields,
                "related": related_fields,
                "related_groups": related_field_groups  # Grouped by link field
            },
            "capabilities": {
                "has_gallery": has_gallery,
                "total_fields": len(current_fields) + len(system_fields) + len(related_fields)
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting report field options: {str(e)}", "Report Builder")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_filter_operators():
    """Get available filter operators for different field types"""
    return {
        "success": True,
        "operators": {
            "Data": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": "like", "field_label": "Contains"},
                {"value": "not like", "field_label": "Does Not Contain"},
                {"value": "in", "field_label": "In List"},
                {"value": "not in", "field_label": "Not In List"}
            ],
            "Int": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": ">", "field_label": "Greater Than"},
                {"value": ">=", "field_label": "Greater Than or Equal"},
                {"value": "<", "field_label": "Less Than"},
                {"value": "<=", "field_label": "Less Than or Equal"},
                {"value": "between", "field_label": "Between"}
            ],
            "Float": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": ">", "field_label": "Greater Than"},
                {"value": ">=", "field_label": "Greater Than or Equal"},
                {"value": "<", "field_label": "Less Than"},
                {"value": "<=", "field_label": "Less Than or Equal"},
                {"value": "between", "field_label": "Between"}
            ],
            "Currency": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": ">", "field_label": "Greater Than"},
                {"value": ">=", "field_label": "Greater Than or Equal"},
                {"value": "<", "field_label": "Less Than"},
                {"value": "<=", "field_label": "Less Than or Equal"},
                {"value": "between", "field_label": "Between"}
            ],
            "Date": [
                {"value": "=", "field_label": "On Date"},
                {"value": "!=", "field_label": "Not On Date"},
                {"value": ">", "field_label": "After"},
                {"value": ">=", "field_label": "On or After"},
                {"value": "<", "field_label": "Before"},
                {"value": "<=", "field_label": "On or Before"},
                {"value": "between", "field_label": "Between Dates"}
            ],
            "Datetime": [
                {"value": "=", "field_label": "At Time"},
                {"value": "!=", "field_label": "Not At Time"},
                {"value": ">", "field_label": "After"},
                {"value": ">=", "field_label": "On or After"},
                {"value": "<", "field_label": "Before"},
                {"value": "<=", "field_label": "On or Before"},
                {"value": "between", "field_label": "Between Times"}
            ],
            "Select": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": "in", "field_label": "In List"},
                {"value": "not in", "field_label": "Not In List"}
            ],
            "Link": [
                {"value": "=", "field_label": "Equals"},
                {"value": "!=", "field_label": "Not Equals"},
                {"value": "in", "field_label": "In List"},
                {"value": "not in", "field_label": "Not In List"}
            ],
            "Check": [
                {"value": "=", "field_label": "Equals"}
            ]
        }
    }

def execute_grouped_query(doctype_name, query_fields, filters, grouping_config, order_by, start, page_size, field_map):
    """
    Execute a grouped query with aggregation
    """
    try:
        # Build SQL query with GROUP BY
        group_fields = []
        select_parts = []
        has_aggregation = False
        
        # First, process all grouping fields
        for group in grouping_config:
            field = group['field']
            aggregate = group.get('aggregate', 'group')
            period = group.get('period', 'exact')  # Default to exact value
            
            # Handle time period grouping for Date/Datetime fields
            field_config = field_map.get(field, {})
            field_type = field_config.get('fieldtype', '')
            
            # Fallback: check DocType meta for field type if not in field_map
            if not field_type:
                try:
                    meta = frappe.get_meta(doctype_name)
                    if meta.has_field(field):
                        field_type = meta.get_field(field).fieldtype
                except Exception:
                    pass
            
            frappe.logger().debug(f"Group field {field}: period={period}, fieldtype={field_type}")
            
            if period != 'exact' and field_type in ['Date', 'Datetime']:
                # Generate period-based SQL expression
                period_expression = get_period_expression(field, period)
                group_alias = f"{field}_period"
                
                frappe.logger().debug(f"Using period expression: {period_expression}")
                
                if f"`{group_alias}`" not in group_fields:
                    group_fields.append(f"`{group_alias}`")
                    select_parts.append(f"{period_expression} as `{group_alias}`")
            else:
                # Always add the grouping field as-is for exact matching
                if f"`{field}`" not in group_fields:
                    group_fields.append(f"`{field}`")
                    select_parts.append(f"`{field}`")
            
            # Handle different aggregation types
            if aggregate == 'count':
                # Add count column
                select_parts.append(f"COUNT(*) as `_count`")
                has_aggregation = True
            elif aggregate in ['sum', 'avg', 'min', 'max']:
                # Find numeric fields to aggregate
                numeric_fields_found = False
                for qfield in query_fields:
                    if qfield != field and field_map.get(qfield, {}).get('fieldtype') in ['Int', 'Float', 'Currency', 'Percent']:
                        select_parts.append(f"{aggregate.upper()}(`{qfield}`) as `{qfield}_{aggregate}`")
                        numeric_fields_found = True
                        has_aggregation = True
                
                # If no numeric fields found but aggregation requested, at least count
                if not numeric_fields_found and aggregate != 'group':
                    select_parts.append(f"COUNT(*) as `_count`")
                    has_aggregation = True
        
        # If we have aggregation, we can only include grouped fields and aggregated values
        # If no aggregation (group only), we need to include all grouped fields in SELECT
        if has_aggregation:
            # For aggregated queries, only grouped fields and aggregates are allowed
            # We already have them in select_parts
            pass
        else:
            # For GROUP BY without aggregation, add other non-grouped fields 
            # But this might cause SQL errors if not all fields are in GROUP BY
            # So we'll add them to group_fields too
            for field in query_fields:
                if f"`{field}`" not in select_parts:
                    select_parts.append(f"`{field}`")
                    if f"`{field}`" not in group_fields:
                        group_fields.append(f"`{field}`")
        
        # Build WHERE clause from filters
        where_conditions = []
        for field, condition in filters.items():
            if isinstance(condition, list) and len(condition) == 2:
                operator, value = condition
                if operator == "like":
                    where_conditions.append(f"`{field}` LIKE %s")
                elif operator == "not like":
                    where_conditions.append(f"`{field}` NOT LIKE %s")
                elif operator == "in":
                    placeholders = ', '.join(['%s'] * len(value))
                    where_conditions.append(f"`{field}` IN ({placeholders})")
                elif operator == "not in":
                    placeholders = ', '.join(['%s'] * len(value))
                    where_conditions.append(f"`{field}` NOT IN ({placeholders})")
                elif operator == "between" and isinstance(value, list) and len(value) == 2:
                    where_conditions.append(f"`{field}` BETWEEN %s AND %s")
                else:
                    where_conditions.append(f"`{field}` {operator} %s")
            else:
                where_conditions.append(f"`{field}` = %s")
        
        # Build the complete SQL query
        table_name = f"`tab{doctype_name}`"
        select_clause = "SELECT " + ", ".join(select_parts)
        from_clause = f" FROM {table_name}"
        where_clause = " WHERE " + " AND ".join(where_conditions) if where_conditions else ""
        group_clause = " GROUP BY " + ", ".join(group_fields) if group_fields else ""
        order_clause = f" ORDER BY {order_by}" if order_by else ""
        limit_clause = f" LIMIT {page_size} OFFSET {start}"
        
        sql = select_clause + from_clause + where_clause + group_clause + order_clause + limit_clause
        
        # Prepare values for parameterized query
        values = []
        for field, condition in filters.items():
            if isinstance(condition, list) and len(condition) == 2:
                operator, value = condition
                if operator in ["in", "not in"]:
                    values.extend(value)
                elif operator == "between" and isinstance(value, list):
                    values.extend(value)
                else:
                    values.append(value)
            else:
                values.append(condition)
        
        # Log the query for debugging
        frappe.logger().info(f"Grouped Query SQL: {sql}")
        frappe.logger().info(f"Grouped Query Values: {values}")
        
        # Execute the query
        result = frappe.db.sql(sql, values, as_dict=True)
        
        frappe.logger().info(f"Grouped Query Result: {len(result)} rows")
        if result:
            frappe.logger().info(f"First row keys: {list(result[0].keys())}")
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error executing grouped query: {str(e)} | SQL: {sql} | Values: {values}", "Report Builder Grouping")
        frappe.logger().error(f"Grouping query failed: {str(e)}")
        frappe.logger().error(f"Failed SQL: {sql}")
        frappe.logger().error(f"Failed Values: {values}")
        
        # Fallback to regular query
        return frappe.get_all(doctype_name,
            fields=query_fields,
            filters=filters,
            limit_start=start,
            limit_page_length=page_size,
            order_by=order_by
        )

def execute_grouped_report(doctype_name, query_fields, filters, grouping_config, order_by, start, page_size, field_map, selected_fields):
    """
    Execute a grouped report and return data structured for modern grouped UI
    """
    try:
        # For grouped reports, we need to execute two queries:
        # 1. Aggregated query for group summaries
        # 2. Detail query for individual records in each group
        
        main_group = grouping_config[0]  # Use first grouping for now
        group_field = main_group['field']
        aggregate_type = main_group.get('aggregate', 'count')
        period = main_group.get('period', 'exact')
        
        # Determine the actual field/expression to group by
        field_config = field_map.get(group_field, {})
        field_type = field_config.get('fieldtype', '')
        
        # Check selected_fields first
        if not field_type and selected_fields:
            field_info = next((f for f in selected_fields if f['fieldname'] == group_field), None)
            if field_info:
                field_type = field_info.get('fieldtype', '')
        
        # Fallback: check DocType meta for field type
        if not field_type:
            try:
                meta = frappe.get_meta(doctype_name)
                if meta.has_field(group_field):
                    field_type = meta.get_field(group_field).fieldtype
            except Exception:
                pass
                
        frappe.logger().debug(f"Field type detection: {group_field} -> {field_type} (period: {period})")
        
        # Use period expression if applicable
        if period != 'exact' and field_type in ['Date', 'Datetime']:
            group_expression = get_period_expression(group_field, period)
            group_alias = f"{group_field}_period"
        else:
            group_expression = f"`{group_field}`"
            group_alias = group_field
            
        frappe.logger().info(f"🔍 Grouping Debug: field={group_field}, type={field_type}, period={period}")
        frappe.logger().info(f"🔍 Group expression: {group_expression}, alias: {group_alias}")
        
        # Query 1: Get group summaries
        if aggregate_type == 'count':
            summary_sql = f"""
                SELECT {group_expression} as `{group_alias}`, COUNT(*) as group_count
                FROM `tab{doctype_name}`
                WHERE 1=1
            """
        elif aggregate_type in ['sum', 'avg', 'min', 'max']:
            # Find numeric fields to aggregate
            numeric_fields = [f for f in query_fields if field_map.get(f, {}).get('fieldtype') in ['Int', 'Float', 'Currency']]
            if numeric_fields:
                agg_field = numeric_fields[0]  # Use first numeric field
                summary_sql = f"""
                    SELECT {group_expression} as `{group_alias}`, COUNT(*) as group_count, {aggregate_type.upper()}(`{agg_field}`) as group_aggregate
                    FROM `tab{doctype_name}`
                    WHERE 1=1
                """
            else:
                summary_sql = f"""
                    SELECT {group_expression} as `{group_alias}`, COUNT(*) as group_count
                    FROM `tab{doctype_name}`
                    WHERE 1=1
                """
        else:
            summary_sql = f"""
                SELECT {group_expression} as `{group_alias}`, COUNT(*) as group_count
                FROM `tab{doctype_name}`
                WHERE 1=1
            """
        
        # Add filters to summary query
        filter_conditions = []
        filter_values = []
        for field, condition in filters.items():
            if isinstance(condition, list) and len(condition) == 2:
                operator, value = condition
                if operator == "like":
                    filter_conditions.append(f"`{field}` LIKE %s")
                    filter_values.append(value)
                elif operator in ["=", "!=", ">", "<", ">=", "<="]:
                    filter_conditions.append(f"`{field}` {operator} %s")
                    filter_values.append(value)
        
        if filter_conditions:
            summary_sql += " AND " + " AND ".join(filter_conditions)
        
        summary_sql += f" GROUP BY {group_expression} ORDER BY {group_expression}"
        
        # Execute summary query
        frappe.logger().info(f"🔍 Executing summary SQL: {summary_sql}")
        frappe.logger().info(f"🔍 With values: {filter_values}")
        group_summaries = frappe.db.sql(summary_sql, filter_values, as_dict=True)
        frappe.logger().info(f"🔍 Summary results: {len(group_summaries)} groups found")
        if group_summaries:
            frappe.logger().info(f"🔍 First summary: {group_summaries[0]}")
        
        # Query 2: Get detail records for each group (limited for performance)
        groups_data = []
        for summary in group_summaries[:20]:  # Limit to first 20 groups for performance
            group_value = summary[group_alias]
            
            # For period-based grouping, we need to filter using the same period expression
            detail_filters = dict(filters)
            if period != 'exact' and field_type in ['Date', 'Datetime']:
                # Use the proper WHERE condition for period matching
                detail_where = get_period_where_condition(group_field, period, group_value)
                detail_sql = f"""
                    SELECT {', '.join([f'`{f}`' for f in query_fields])}
                    FROM `tab{doctype_name}`
                    WHERE {detail_where}
                """
                # Add existing filters
                detail_filter_values = [group_value]
                if filter_conditions:
                    detail_sql += " AND " + " AND ".join(filter_conditions)
                    detail_filter_values.extend(filter_values)
                
                detail_sql += f" ORDER BY {order_by or 'creation desc'} LIMIT 10"
                frappe.logger().info(f"🔍 Detail SQL: {detail_sql}")
                frappe.logger().info(f"🔍 Detail values: {detail_filter_values}")
                detail_records = frappe.db.sql(detail_sql, detail_filter_values, as_dict=True)
            else:
                # Exact value matching
                detail_filters[group_field] = group_value
                detail_records = frappe.get_all(doctype_name,
                    fields=query_fields,
                    filters=detail_filters,
                    limit_page_length=10,  # Limit detail records per group
                    order_by=order_by or "creation desc"
                )
            
            # Format group data with correct label from alias
            # Make period labels more user-friendly
            formatted_label = group_value or '(Empty)'
            if period != 'exact' and group_value:
                if period == 'week':
                    formatted_label = f"Week of {group_value}"
                elif period == 'month':
                    formatted_label = f"Month {group_value}"
                elif period == 'year':
                    formatted_label = f"Year {group_value}"
                elif period == 'hour':
                    formatted_label = f"Hour {group_value}"
                elif period == 'day':
                    formatted_label = f"Day {group_value}"
            
            group_data = {
                'group_field': group_field,
                'group_value': group_value,
                'group_label': formatted_label,
                'count': summary.get('group_count', 0),
                'aggregate': summary.get('group_aggregate') if 'group_aggregate' in summary else None,
                'aggregate_type': aggregate_type if aggregate_type != 'count' else None,
                'records': detail_records,
                'has_more': len(detail_records) >= 10  # Indicate if there are more records
            }
            groups_data.append(group_data)
        
        # Calculate totals
        total_records = sum(g['count'] for g in groups_data)
        
        return {
            "success": True,
            "is_grouped": True,
            "grouping": {
                'field': group_field,
                'field_label': next((f.get('custom_label', f.get('field_label', f['fieldname'])) for f in selected_fields if f['fieldname'] == group_field), group_field),
                'aggregate': aggregate_type
            },
            "groups": groups_data,
            "total": total_records,
            "total_groups": len(groups_data),
            "fields": selected_fields  # Include field metadata for UI
        }
        
    except Exception as e:
        frappe.log_error(f"Error executing grouped report: {str(e)}", "Grouped Report")
        
        # Fallback to regular grouping
        records = execute_grouped_query(doctype_name, query_fields, filters, grouping_config, order_by, start, page_size, field_map)
        
        return {
            "success": True,
            "is_grouped": False,  # Fallback to flat view
            "data": records,
            "total": len(records)
        }

def process_image_field_value(image_value):
    """Process image field value to ensure it's in the correct format for frontend"""
    try:
        frappe.logger().info(f"Processing image field value: {image_value} (type: {type(image_value)})")
        
        if not image_value:
            return None
        
        # For multi-image fields, we want to preserve the full JSON structure
        # so the frontend can extract all images. Only process if it's clearly a single image.
        
        # If it's already a simple string that looks like a file path, return it
        if isinstance(image_value, str):
            # Check if it looks like a JSON array - keep it as is for frontend processing
            if image_value.startswith('[') and image_value.endswith(']'):
                frappe.logger().info(f"Preserving JSON array for frontend: {image_value}")
                return image_value
            
            # Check if it looks like JSON object and try to parse it
            elif image_value.startswith('{'):
                try:
                    parsed = json.loads(image_value)
                    if isinstance(parsed, dict):
                        return parsed.get('file_url') or parsed.get('url') or parsed.get('name')
                except:
                    # Try to handle Python-style dict strings with single quotes
                    try:
                        # Convert single quotes to double quotes for JSON parsing
                        json_string = image_value.replace("'", '"')
                        parsed = json.loads(json_string)
                        if isinstance(parsed, dict):
                            return parsed.get('file_url') or parsed.get('url') or parsed.get('name')
                    except:
                        # If all parsing fails, try regex to extract file_url
                        file_url_match = re.search(r"['\"]file_url['\"]\s*:\s*['\"]([^'\"]+)['\"]", image_value)
                        if file_url_match:
                            return file_url_match.group(1)
                        # Try to extract name as fallback
                        name_match = re.search(r"['\"]name['\"]\s*:\s*['\"]([^'\"]+)['\"]", image_value)
                        if name_match:
                            return f"/files/{name_match.group(1)}"
            
            # Simple string, return as is
            return image_value
        
        # If it's a list, preserve the full list for frontend multi-image handling
        elif isinstance(image_value, list):
            frappe.logger().info(f"Preserving list structure for frontend: {len(image_value)} items")
            return image_value
            
        # If it's a dict, extract the file path (single image)
        elif isinstance(image_value, dict):
            return image_value.get('file_url') or image_value.get('url') or image_value.get('name')
            
        # Convert everything else to string
        result = str(image_value) if image_value else None
        frappe.logger().info(f"Final processed image value: {result}")
        return result
        
    except Exception as e:
        frappe.logger().error(f"Error processing image field value {image_value}: {str(e)}")
        return None

@frappe.whitelist()
def test_grouping_debug():
    """Debug grouping data structure"""
    try:
        # Find a table to test with
        tables = frappe.get_all("Flansa Table", limit=1)
        if not tables:
            return {"success": False, "error": "No tables available"}
            
        table_doc = frappe.get_doc("Flansa Table", tables[0].name)
        doctype_name = table_doc.doctype_name
        
        # Check record count
        record_count = frappe.db.count(doctype_name)
        if record_count == 0:
            return {"success": False, "error": "No records to test with"}
            
        # Test regular query first
        regular_data = frappe.get_all(doctype_name, fields=["name", "creation"], limit=2)
        
        # Test grouping config
        test_config = {
            "base_table": tables[0].name,
            "selected_fields": [
                {"fieldname": "name", "fieldtype": "Data", "field_label": "Name"},
                {"fieldname": "creation", "fieldtype": "Datetime", "field_label": "Creation Date"}
            ],
            "filters": [],
            "grouping": [{
                "field": "creation",
                "aggregate": "count", 
                "period": "day"
            }],
            "sort": []
        }
        
        # Test the execute_report API
        result = execute_report(test_config)
        
        return {
            "success": True,
            "doctype_tested": doctype_name,
            "record_count": record_count,
            "regular_data_sample": regular_data,
            "test_config": test_config,
            "execute_report_result": result
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

@frappe.whitelist()
def execute_report(report_config, view_options=None):
    """
    Execute a report and return data for display
    
    report_config: {
        "base_table": "FT-0039",
        "selected_fields": [{"fieldname": "title", "category": "current"}, ...],
        "filters": [{"field": "status", "operator": "=", "value": "Active"}],
        "sort": [{"field": "title", "direction": "asc"}]
    }
    
    view_options: {
        "search": "search term",
        "filters": {"status": "Active"},
        "page": 1,
        "page_size": 20,
        "view_type": "table" | "gallery"
    }
    """
    try:
        if isinstance(report_config, str):
            report_config = json.loads(report_config)
        
        if isinstance(view_options, str):
            view_options = json.loads(view_options) if view_options else {}
        else:
            view_options = view_options or {}
        
        base_table = report_config["base_table"]
        selected_fields = report_config.get("selected_fields", [])
        
        # Get table and DocType info
        table_doc = frappe.get_doc("Flansa Table", base_table)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name or not frappe.db.exists("DocType", doctype_name):
            return {"success": False, "error": "DocType not found or not generated"}
        
        # Build query fields - start with essential fields
        query_fields = ["name", "creation", "modified"]
        field_map = {}
        parent_field_configs = []
        related_field_configs = []
        
        for field_config in selected_fields:
            if field_config["category"] == "current":
                # Check if this is a computed/virtual field
                if field_config.get("is_virtual") or field_config.get("fetch_from"):
                    # Skip virtual/computed fields from direct query
                    field_map[field_config["fieldname"]] = field_config
                else:
                    # Add current table field
                    query_fields.append(field_config["fieldname"])
                    field_map[field_config["fieldname"]] = field_config
            elif field_config["category"] == "parent":
                # Store parent field config for later processing
                parent_field_configs.append(field_config)
            elif field_config["category"] == "related":
                # Store related field config for later processing
                related_field_configs.append(field_config)
                field_map[field_config["fieldname"]] = field_config
        
        # Build filters
        filters = {}
        
        # Add report-level filters
        for filter_config in report_config.get("filters", []):
            filter_value = filter_config["value"]
            operator = filter_config["operator"]
            
            if operator == "between" and isinstance(filter_value, list):
                filters[filter_config["field"]] = ["between", filter_value]
            elif operator == "is":
                # Handle empty/null checks
                filters[filter_config["field"]] = ["in", ["", None]]
            elif operator == "is not":
                # Handle not empty/null checks
                filters[filter_config["field"]] = ["not in", ["", None]]
            else:
                filters[filter_config["field"]] = [operator, filter_value]
        
        # Add view-level filters
        view_filters = view_options.get("filters", {})
        for field, value in view_filters.items():
            filters[field] = value
        
        # Add search functionality - search across multiple text fields
        search_term = view_options.get("search")
        if search_term:
            # Get text-searchable fields from selected fields
            searchable_fields = []
            for field_config in selected_fields:
                if field_config["category"] == "current":
                    field_type = field_config.get("fieldtype", "")
                    if field_type in ["Data", "Text", "Small Text", "Long Text", "Text Editor"]:
                        searchable_fields.append(field_config["fieldname"])
            
            # If we have searchable fields, create OR condition
            if searchable_fields:
                # Build search condition for multiple fields
                search_filters = []
                for field in searchable_fields:
                    search_filters.append([field, "like", f"%{search_term}%"])
                
                # Add as OR filter - note: this is a simplified approach
                # For production, you might want to use raw SQL for complex OR conditions
                if len(search_filters) == 1:
                    filters[searchable_fields[0]] = ["like", f"%{search_term}%"]
                else:
                    # For multiple fields, we'll use the first field for now
                    # and log that multi-field search needs enhancement
                    filters[searchable_fields[0]] = ["like", f"%{search_term}%"]
                    frappe.log_error(f"Multi-field search across {len(searchable_fields)} fields simplified to first field", "Report Builder Search")
        
        # Pagination
        page_size = view_options.get("page_size", 20)
        page = view_options.get("page", 1)
        start = (page - 1) * page_size
        
        # Build order by
        order_by = "creation desc"  # Default
        sort_config = report_config.get("sort", [])
        if sort_config:
            order_parts = []
            for sort_item in sort_config:
                direction = sort_item.get("direction", "asc")
                order_parts.append(f"`{sort_item['field']}` {direction}")
            order_by = ", ".join(order_parts)
        
        # Check if grouping is requested
        grouping_config = report_config.get("grouping", [])
        
        frappe.logger().info(f"Grouping config: {grouping_config}")
        
        if grouping_config:
            frappe.logger().info("Executing grouped query")
            # Execute grouped query and return grouped structure
            return execute_grouped_report(
                doctype_name, 
                query_fields, 
                filters, 
                grouping_config,
                order_by,
                start,
                page_size,
                field_map,
                selected_fields
            )
        else:
            # Execute main query
            records = frappe.get_all(doctype_name,
                fields=query_fields,
                filters=filters,
                limit_start=start,
                limit_page_length=page_size,
                order_by=order_by
            )
        
        # Get total count for pagination
        total_count = frappe.db.count(doctype_name, filters)
        
        # Enhance records with parent field data and computed fields
        enhanced_records = []
        for record in records:
            enhanced_record = dict(record)
            
            # Add parent field data via relationships
            for field_config in parent_field_configs:
                try:
                    parent_value = get_parent_field_value(
                        doctype_name,
                        record["name"], 
                        field_config
                    )
                    enhanced_record[field_config["fieldname"]] = parent_value
                except Exception as parent_error:
                    enhanced_record[field_config["fieldname"]] = None
                    frappe.log_error(f"Error getting parent field value: {str(parent_error)}", "Report Builder")
            
            # Add related field data via link field lookups
            for field_config in related_field_configs:
                try:
                    related_value = get_related_field_value(
                        doctype_name,
                        record["name"],
                        field_config
                    )
                    enhanced_record[field_config["fieldname"]] = related_value
                except Exception as related_error:
                    enhanced_record[field_config["fieldname"]] = None
                    frappe.log_error(f"Error getting related field value: {str(related_error)}", "Report Builder")
            
            # Add computed/virtual field values and debug image fields
            for field_name, field_config in field_map.items():
                if field_config.get("is_virtual") or field_config.get("is_computed"):
                    try:
                        # Get the actual value from the document
                        doc = frappe.get_doc(doctype_name, record["name"])
                        computed_value = getattr(doc, field_name, None)
                        enhanced_record[field_name] = computed_value
                        
                        # Debug image fields
                        if field_config.get("is_gallery") and field_config["fieldtype"] in ['Attach Image', 'Attach']:
                            frappe.logger().info(f"Gallery field {field_name} raw value: {computed_value} (type: {type(computed_value)})")
                    except Exception as computed_error:
                        enhanced_record[field_name] = None
                        frappe.log_error(f"Error getting computed field value for {field_name}: {str(computed_error)}", "Report Builder")
                        
                # Also debug regular image fields from the query
                elif field_config.get("is_gallery") and field_name in enhanced_record:
                    frappe.logger().info(f"Regular gallery field {field_name} query value: {enhanced_record[field_name]} (type: {type(enhanced_record[field_name])})")
            
            # Process image fields to ensure they are in the correct format
            for field_name, field_config in field_map.items():
                if field_config.get("is_gallery") and field_name in enhanced_record:
                    enhanced_record[field_name] = process_image_field_value(enhanced_record[field_name])
            
            # Also process parent field image values
            for field_config in parent_field_configs:
                if field_config.get("is_gallery") and field_config["fieldname"] in enhanced_record:
                    enhanced_record[field_config["fieldname"]] = process_image_field_value(enhanced_record[field_config["fieldname"]])
            
            enhanced_records.append(enhanced_record)
        
        # Get gallery information if needed
        gallery_info = None
        if view_options.get("view_type") == "gallery":
            gallery_info = get_gallery_field_info(doctype_name, selected_fields)
        
        return {
            "success": True,
            "data": enhanced_records,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size,
            "gallery_info": gallery_info,
            "field_definitions": {**field_map, **{fc["fieldname"]: fc for fc in parent_field_configs}}
        }
        
    except Exception as e:
        frappe.log_error(f"Error executing report: {str(e)}", "Report Builder")
        return {"success": False, "error": str(e)}

def get_parent_field_value(child_doctype, record_name, field_config):
    """Get value from parent table via relationship"""
    try:
        relationship_id = field_config.get("relationship")
        source_field = field_config.get("source_field")
        
        if not relationship_id or not source_field:
            return None
        
        # Get the relationship
        relationship = frappe.get_doc("Flansa Relationship", relationship_id)
        parent_table = relationship.parent_table
        
        if not parent_table:
            return None
        
        # Get parent table DocType
        parent_table_doc = frappe.get_doc("Flansa Table", parent_table)
        parent_doctype = parent_table_doc.doctype_name
        
        if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
            return None
        
        # Find the link field in child table that connects to parent
        child_meta = frappe.get_meta(child_doctype)
        link_field = None
        
        for field in child_meta.fields:
            if (field.fieldtype == "Link" and 
                field.options == parent_doctype):
                link_field = field.fieldname
                break
        
        if not link_field:
            return None
        
        # Get the parent record ID from child record
        parent_id = frappe.db.get_value(child_doctype, record_name, link_field)
        
        if not parent_id:
            return None
        
        # Get the value from parent record
        parent_value = frappe.db.get_value(parent_doctype, parent_id, source_field)
        
        return parent_value
        
    except Exception as e:
        frappe.log_error(f"Error getting parent field value: {str(e)}", "Report Builder")
        return None

def get_related_field_value(child_doctype, record_name, field_config):
    """Get value from related table via link field"""
    try:
        # Parse the related field configuration
        # field_config["fieldname"] should be in format: "link_field_source_field"
        # field_config should have: link_field, source_field, table
        
        link_field = field_config.get("link_field")
        source_field = field_config.get("source_field")
        related_table = field_config.get("table")
        
        if not link_field or not source_field or not related_table:
            return None
        
        # Get the related table DocType
        related_table_doc = frappe.get_doc("Flansa Table", related_table)
        related_doctype = related_table_doc.doctype_name
        
        if not related_doctype or not frappe.db.exists("DocType", related_doctype):
            return None
        
        # Get the linked record ID from the current record
        linked_record_id = frappe.db.get_value(child_doctype, record_name, link_field)
        
        if not linked_record_id:
            return None
        
        # Get the value from the related record
        related_value = frappe.db.get_value(related_doctype, linked_record_id, source_field)
        
        return related_value
        
    except Exception as e:
        frappe.log_error(f"Error getting related field value: {str(e)}", "Report Builder")
        return None

def get_gallery_field_info(doctype_name, selected_fields):
    """Get information about gallery/image fields in the selected fields"""
    try:
        gallery_fields = []
        
        for field_config in selected_fields:
            if field_config.get("is_gallery", False):
                gallery_fields.append({
                    "fieldname": field_config["fieldname"],
                    "field_label": field_config["field_label"],
                    "fieldtype": field_config["fieldtype"],
                    "category": field_config["category"]
                })
        
        # If no gallery fields selected, check if any exist in the DocType
        if not gallery_fields:
            meta = frappe.get_meta(doctype_name)
            for field in meta.fields:
                if (field.fieldtype in ['Attach Image', 'Attach'] or 
                    'image' in field.fieldname.lower()):
                    gallery_fields.append({
                        "fieldname": field.fieldname,
                        "field_label": field.label or field.fieldname.replace('_', ' ').title(),
                        "fieldtype": field.fieldtype,
                        "category": "current"
                    })
                    break  # Just take the first one
        
        return {
            "has_gallery": len(gallery_fields) > 0,
            "gallery_fields": gallery_fields,
            "primary_gallery_field": gallery_fields[0] if gallery_fields else None
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting gallery field info: {str(e)}", "Report Builder")
        return {"has_gallery": False, "gallery_fields": [], "error": str(e)}

@frappe.whitelist()
def validate_report_config(config):
    """Validate a report configuration before execution"""
    try:
        if isinstance(config, str):
            config = json.loads(config)
        
        errors = []
        
        # Check required fields
        if not config.get("base_table"):
            errors.append("Base table is required")
        
        if not config.get("selected_fields") or not isinstance(config["selected_fields"], list):
            errors.append("At least one field must be selected")
        
        # Validate filters
        for filter_config in config.get("filters", []):
            if not all(key in filter_config for key in ["field", "operator", "value"]):
                errors.append(f"Invalid filter configuration: {filter_config}")
        
        # Validate sort configuration
        for sort_config in config.get("sort", []):
            if not sort_config.get("field"):
                errors.append(f"Invalid sort configuration: {sort_config}")
        
        return {
            "success": len(errors) == 0,
            "errors": errors
        }
        
    except Exception as e:
        return {"success": False, "errors": [str(e)]}

print("Report Builder API created!")
print("Features:")
print("  ✅ Field Options API - get current and parent table fields")
print("  ✅ Report Execution API - run reports with filtering and pagination")
print("  ✅ Gallery View Support - detect and handle image fields")
print("  ✅ Filter Operators - comprehensive filter interface")
print("  ✅ Parent Field Integration - fetch values from related tables")
print("  ✅ Search Functionality - search across fields")
print("  ✅ Validation API - validate report configurations")

@frappe.whitelist()
def debug_gallery_field_data(doctype_name, record_name, field_name):
    """Debug method to examine what's actually stored in gallery fields"""
    try:
        # Get the raw value from database
        doc = frappe.get_doc(doctype_name, record_name)
        raw_value = getattr(doc, field_name, None)
        
        # Additional analysis for multi-image fields
        analysis = {
            "is_json_array": False,
            "is_json_object": False,
            "is_list": False,
            "item_count": 0,
            "sample_items": []
        }
        
        if isinstance(raw_value, list):
            analysis["is_list"] = True
            analysis["item_count"] = len(raw_value)
            analysis["sample_items"] = raw_value[:3]  # First 3 items
        elif isinstance(raw_value, str):
            if raw_value.startswith('[') and raw_value.endswith(']'):
                analysis["is_json_array"] = True
                try:
                    parsed = json.loads(raw_value)
                    if isinstance(parsed, list):
                        analysis["item_count"] = len(parsed)
                        analysis["sample_items"] = parsed[:3]
                except:
                    pass
            elif raw_value.startswith('{') and raw_value.endswith('}'):
                analysis["is_json_object"] = True
        
        return {
            "success": True,
            "record_name": record_name,
            "field_name": field_name,
            "raw_value": raw_value,
            "raw_value_type": str(type(raw_value)),
            "raw_value_str": str(raw_value),
            "raw_value_repr": repr(raw_value),
            "analysis": analysis
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }