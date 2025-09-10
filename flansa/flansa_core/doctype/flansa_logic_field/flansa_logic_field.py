#!/usr/bin/env python3

import frappe
from frappe.model.document import Document
import json
import time
from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine

class FlansaLogicField(Document):
    def validate(self):
        """Validate logic field configuration"""
        
        if not self.field_name:
            frappe.throw("Field Name is required")
            
        if not self.field_label:
            frappe.throw("Field Label is required")
            
        if not self.table_name:
            frappe.throw("Table is required")
            
        if not self.logic_expression:
            frappe.throw("Logic Expression is required")
            
        # Validate field name format (alphanumeric + underscore)
        if not self.field_name.replace("_", "").isalnum():
            frappe.throw("Field Name must contain only letters, numbers, and underscores")
            
        # Set workspace_id if not set
        if not self.workspace_id:
            from flansa.flansa_core.tenant_service import TenantContext
            self.workspace_id = TenantContext.get_current_workspace_id()
            
    def before_save(self):
        """Test logic expression before saving"""
        
        if self.logic_expression and self.test_data:
            try:
                self.test_logic_expression()
            except Exception as e:
                frappe.throw(f"Logic expression test failed: {str(e)}")
                
    def test_logic_expression(self):
        """Test the logic expression with test data"""
        
        try:
            start_time = time.time()
            
            # Parse test data
            test_data = {}
            if self.test_data:
                test_data = json.loads(self.test_data)
            
            # Get logic engine
            engine = get_logic_engine()
            
            # Test the expression
            result = engine.evaluate_logic(self.logic_expression, test_data)
            
            # Calculate execution time
            execution_time = int((time.time() - start_time) * 1000)
            
            # Update test results
            self.test_result = str(result)
            self.calculation_time_ms = execution_time
            self.last_calculated = frappe.utils.now()
            self.error_details = None
            
            return result
            
        except Exception as e:
            self.test_result = None
            self.error_details = str(e)
            self.last_calculated = frappe.utils.now()
            raise e
            
    def calculate_field_value(self, record_data):
        """Calculate field value for a specific record"""
        
        try:
            start_time = time.time()
            
            # Get logic engine
            engine = get_logic_engine()
            
            # Evaluate expression with record data
            result = engine.evaluate_logic(self.logic_expression, record_data)
            
            # Update calculation stats
            execution_time = int((time.time() - start_time) * 1000)
            self.calculation_time_ms = execution_time
            self.last_calculated = frappe.utils.now()
            self.error_details = None
            
            # Cache result if enabled
            if self.cache_result:
                self.save(ignore_permissions=True)
            
            return result
            
        except Exception as e:
            self.error_details = str(e)
            self.last_calculated = frappe.utils.now()
            
            if self.cache_result:
                self.save(ignore_permissions=True)
                
            raise e
            
    def get_dependencies(self):
        """Get list of field dependencies"""
        
        if self.field_dependencies:
            try:
                return json.loads(self.field_dependencies)
            except:
                return self.field_dependencies.split(',')
        
        return []
        
    def update_dependencies(self, dependencies):
        """Update field dependencies"""
        
        if isinstance(dependencies, list):
            self.field_dependencies = json.dumps(dependencies)
        else:
            self.field_dependencies = str(dependencies)

@frappe.whitelist()
def test_logic_field(logic_field_name, test_data=None):
    """Test a logic field with optional test data"""
    
    logic_field = frappe.get_doc("Flansa Logic Field", logic_field_name)
    
    if test_data:
        # Temporarily set test data
        original_test_data = logic_field.test_data
        logic_field.test_data = test_data
        
    try:
        result = logic_field.test_logic_expression()
        return {
            "status": "success",
            "result": result,
            "calculation_time_ms": logic_field.calculation_time_ms
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        if test_data:
            logic_field.test_data = original_test_data

@frappe.whitelist()
def get_logic_fields_for_table(table_name):
    """Get all active logic fields for a table"""
    
    from flansa.flansa_core.tenant_service import apply_tenant_filter
    
    filters = apply_tenant_filter({
        "table_name": table_name,
        "is_active": 1
    })
    
    return frappe.get_all("Flansa Logic Field",
                         filters=filters,
                         fields=["name", "field_name", "field_label", "field_type", 
                                "logic_expression", "calculation_type", "update_frequency"])

@frappe.whitelist()
def calculate_logic_fields_for_record(table_name, record_data):
    """Calculate all logic fields for a record"""
    
    logic_fields = get_logic_fields_for_table(table_name)
    results = {}
    
    for field in logic_fields:
        try:
            logic_field_doc = frappe.get_doc("Flansa Logic Field", field.name)
            result = logic_field_doc.calculate_field_value(record_data)
            results[field.field_name] = result
        except Exception as e:
            results[field.field_name] = {
                "error": str(e),
                "field_label": field.field_label
            }
    
    return results