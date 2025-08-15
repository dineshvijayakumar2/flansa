"""
Enhanced Flansa Formula Engine
QuickBase-style formula system with advanced relationship traversal
"""

import frappe
from frappe import _
import ast
import operator
import re
import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Union
import math

class FlansaFormulaEngine:
    """
    Safe formula evaluation engine that can traverse relationships
    and perform calculations on related data
    """
    
    # Allowed operators for safe evaluation
    OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
        ast.Eq: operator.eq,
        ast.NotEq: operator.ne,
        ast.Lt: operator.lt,
        ast.LtE: operator.le,
        ast.Gt: operator.gt,
        ast.GtE: operator.ge,
        ast.And: operator.and_,
        ast.Or: operator.or_,
        ast.Not: operator.not_,
    }
    
    # Allowed functions
    FUNCTIONS = {
        'sum': sum,
        'min': min,
        'max': max,
        'len': len,
        'abs': abs,
        'round': round,
        'avg': lambda x: sum(x) / len(x) if x else 0,
        'count': len,
        'if': lambda cond, true_val, false_val: true_val if cond else false_val,
        'today': lambda: frappe.utils.today(),
        'now': lambda: frappe.utils.now(),
        'days_between': lambda d1, d2: (frappe.utils.getdate(d2) - frappe.utils.getdate(d1)).days,
    }
    
    def __init__(self, doc, doctype):
        self.doc = doc
        self.doctype = doctype
        self.context = {}
        self.relationship_cache = {}
        self._build_enhanced_context()
    
    def _build_enhanced_context(self):
        """Build comprehensive context with relationships and QuickBase-style functions"""
        # Core document fields
        self.context.update(self.doc.as_dict())
        
        # Enhanced function library
        self.context.update({
            # Math functions
            'ABS': lambda x: abs(x) if x is not None else 0,
            'ROUND': lambda x, decimals=0: round(x, decimals) if x is not None else 0,
            'SQRT': lambda x: math.sqrt(x) if x and x >= 0 else 0,
            'POWER': lambda x, y: pow(x, y) if x is not None and y is not None else 0,
            
            # Aggregation functions
            'SUM': self._enhanced_sum,
            'AVERAGE': self._enhanced_average,
            'AVG': self._enhanced_average,
            'COUNT': self._enhanced_count,
            'MIN': self._enhanced_min,
            'MAX': self._enhanced_max,
            
            # Conditional functions
            'IF': lambda condition, true_val, false_val: true_val if condition else false_val,
            'IIF': lambda condition, true_val, false_val: true_val if condition else false_val,
            
            # Text functions
            'CONCATENATE': self._concatenate,
            'UPPER': lambda text: str(text).upper() if text is not None else '',
            'LOWER': lambda text: str(text).lower() if text is not None else '',
            'LEN': lambda text: len(str(text)) if text is not None else 0,
            
            # Date functions
            'TODAY': lambda: frappe.utils.today(),
            'NOW': lambda: frappe.utils.now(),
            'DAYS_BETWEEN': self._days_between,
            'YEAR': lambda date_val: frappe.utils.getdate(date_val).year if date_val else None,
            'MONTH': lambda date_val: frappe.utils.getdate(date_val).month if date_val else None,
            
            # Helper functions for QuickBase syntax
            'get_current_value': self._get_current_value,
            'get_related_value': self._get_related_value,
            'get_child_values': self._get_child_values,
        })
    
    def _add_relationship_accessors(self, context):
        """Add relationship data accessors to context"""
        # Get all relationships for this table
        table_name = frappe.db.get_value("DocType", self.doctype, "module")
        if not table_name:
            return
        
        relationships = frappe.get_all("Flansa Relationship",
            filters=[
                ["from_table", "=", table_name],
                ["or", "to_table", "=", table_name]
            ],
            fields=["name", "from_table", "to_table", "relationship_type"]
        )
        
        for rel in relationships:
            rel_doc = frappe.get_doc("Flansa Relationship", rel.name)
            
            if rel.from_table == table_name:
                # Outgoing relationship
                related_table = frappe.get_doc("Flansa Table", rel.to_table)
                accessor_name = related_table.table_name.lower()
                
                # Create accessor function
                def make_accessor(relationship, target_doctype):
                    def accessor():
                        return self._get_related_data(relationship, target_doctype)
                    return accessor
                
                context[accessor_name] = make_accessor(rel_doc, related_table.doctype_name)
    
    def _get_related_data(self, relationship, target_doctype):
        """Get related data based on relationship type"""
        if relationship.relationship_type == "One to Many":
            # Get child records
            link_field = relationship.to_field or relationship.get_clean_field_name(relationship.from_table)
            return frappe.get_all(target_doctype,
                filters={link_field: self.doc.name},
                fields=["*"]
            )
        # Add other relationship types...
        return []
    
    def evaluate_quickbase_formula(self, formula):
        """Evaluate QuickBase-style formula with [Field] and [Table.Field] syntax"""
        try:
            # Preprocess QuickBase syntax
            processed_formula = self._preprocess_quickbase_formula(formula)
            
            # Create safe evaluation environment
            safe_dict = {"__builtins__": {}, **self.context}
            
            # Evaluate the processed formula
            result = eval(processed_formula, safe_dict)
            return result
            
        except Exception as e:
            frappe.log_error(f"Formula evaluation error: {str(e)}\nFormula: {formula}", "Enhanced Formula Engine")
            return f"#ERROR: {str(e)}"
    
    def evaluate(self, formula):
        """Safely evaluate a formula (legacy method)"""
        return self.evaluate_quickbase_formula(formula)
    
    def _validate_ast(self, tree):
        """Validate AST to ensure it's safe to evaluate"""
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id not in self.context:
                # Check if it's a relationship accessor pattern
                if '.' not in str(node.id):
                    raise ValueError(f"Unknown variable: {node.id}")
            
            # Disallow dangerous operations
            if isinstance(node, (ast.Import, ast.ImportFrom, ast.Exec)):
                raise ValueError("Import/Exec not allowed in formulas")
    
    def _eval_node(self, node):
        """Recursively evaluate an AST node"""
        if isinstance(node, ast.Num):
            return node.n
        
        elif isinstance(node, ast.Str):
            return node.s
        
        elif isinstance(node, ast.Name):
            return self.context.get(node.id)
        
        elif isinstance(node, ast.BinOp):
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            return self.OPERATORS[type(node.op)](left, right)
        
        elif isinstance(node, ast.UnaryOp):
            operand = self._eval_node(node.operand)
            return self.OPERATORS[type(node.op)](operand)
        
        elif isinstance(node, ast.Compare):
            left = self._eval_node(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                right = self._eval_node(comparator)
                if not self.OPERATORS[type(op)](left, right):
                    return False
                left = right
            return True
        
        elif isinstance(node, ast.Call):
            func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
            if func_name not in self.FUNCTIONS:
                raise ValueError(f"Function not allowed: {func_name}")
            
            args = [self._eval_node(arg) for arg in node.args]
            return self.FUNCTIONS[func_name](*args)
        
        elif isinstance(node, ast.Attribute):
            # Handle relationship traversal (e.g., orders.total_amount)
            value = self._eval_node(node.value)
            return self._get_attribute(value, node.attr)
        
        else:
            raise ValueError(f"Unsupported operation: {type(node)}")
    
    def _get_attribute(self, obj, attr):
        """Get attribute from object, handling special cases"""
        if isinstance(obj, list):
            # Aggregate operation on list
            if attr == 'sum':
                return sum(obj)
            elif attr == 'count':
                return len(obj)
            elif attr == 'avg':
                return sum(obj) / len(obj) if obj else 0
            # Extract attribute from all items
            return [getattr(item, attr, None) for item in obj]
        
        return getattr(obj, attr, None)

# Formula field type for DocTypes
class FormulaField:
    """Custom field type that evaluates formulas"""
    
    @staticmethod
    def get_value(doc, fieldname):
        """Get computed value for formula field"""
        field = frappe.get_meta(doc.doctype).get_field(fieldname)
        if not field or not field.options:
            return None
        
        try:
            options = json.loads(field.options)
            formula = options.get('formula')
            if not formula:
                return None
            
            engine = FlansaFormulaEngine(doc, doc.doctype)
            return engine.evaluate(formula)
            
        except Exception as e:
            frappe.log_error(f"Formula evaluation error: {str(e)}", "Formula Field")
            return None

@frappe.whitelist()
def validate_formula(formula, doctype):
    """Validate a formula for a given doctype"""
    try:
        # Create a dummy doc for validation
        dummy_doc = frappe.new_doc(doctype)
        engine = FlansaFormulaEngine(dummy_doc, doctype)
        
        # Try to parse the formula
        ast.parse(formula, mode='eval')
        
        return {
            'valid': True,
            'message': _('Formula is valid')
        }
    except SyntaxError as e:
        return {
            'valid': False,
            'message': _('Syntax error: {0}').format(str(e))
        }
    except Exception as e:
        return {
            'valid': False,
            'message': str(e)
        }

@frappe.whitelist()
def get_formula_suggestions(doctype, partial_formula):
    """Get autocomplete suggestions for formula editor"""
    suggestions = []
    
    # Get fields from current doctype
    meta = frappe.get_meta(doctype)
    for field in meta.fields:
        if field.fieldtype not in ['Section Break', 'Column Break']:
            suggestions.append({
                'value': field.fieldname,
                'label': f"{field.label} ({field.fieldtype})",
                'type': 'field'
            })
    
    # Get relationships
    table_name = frappe.db.get_value("DocType", doctype, "module")
    if table_name:
        relationships = frappe.get_all("Flansa Relationship",
            filters=[
                ["from_table", "=", table_name],
                ["status", "=", "Active"]
            ],
            fields=["to_table"]
        )
        
        for rel in relationships:
            to_table = frappe.get_doc("Flansa Table", rel.to_table)
            suggestions.append({
                'value': to_table.table_name.lower(),
                'label': f"{to_table.table_label} (Relationship)",
                'type': 'relationship'
            })
    
    # Add functions
    for func in ['sum', 'avg', 'min', 'max', 'count', 'if', 'round']:
        suggestions.append({
            'value': func,
            'label': f"{func}()",
            'type': 'function'
        })
    
    return suggestions


    def _preprocess_quickbase_formula(self, formula):
        """Convert QuickBase syntax to Python syntax"""
        processed = formula
        
        # Handle aggregation functions: SUM([Child.Field])
        agg_pattern = r'(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\(\[([^.\]]+)\.([^\]]+)\]\)'
        def replace_agg(match):
            func, table, field = match.groups()
            return f"{func}(get_child_values('{table.lower()}', '{field.lower()}'))"
        processed = re.sub(agg_pattern, replace_agg, processed, flags=re.IGNORECASE)
        
        # Handle relationship references: [Table.Field]
        rel_pattern = r'\[([^.\]]+)\.([^\]]+)\]'
        def replace_rel(match):
            table, field = match.groups()
            return f"get_related_value('{table.lower()}', '{field.lower()}')"
        processed = re.sub(rel_pattern, replace_rel, processed, flags=re.IGNORECASE)
        
        # Handle current field references: [Field]
        field_pattern = r'\[([^\.\]]+)\]'
        def replace_field(match):
            field = match.group(1)
            return f"get_current_value('{field.lower()}')"
        processed = re.sub(field_pattern, replace_field, processed, flags=re.IGNORECASE)
        
        return processed
    
    def _enhanced_sum(self, data_list):
        """Enhanced SUM with null handling"""
        if not isinstance(data_list, (list, tuple)):
            return data_list if data_list is not None else 0
        total = 0
        for item in data_list:
            if item is not None and str(item).replace('.','').replace('-','').isdigit():
                total += float(item)
        return total
    
    def _enhanced_average(self, data_list):
        """Enhanced AVERAGE function"""
        if not isinstance(data_list, (list, tuple)):
            return data_list if data_list is not None else 0
        valid_items = [float(item) for item in data_list 
                      if item is not None and str(item).replace('.','').replace('-','').isdigit()]
        return sum(valid_items) / len(valid_items) if valid_items else 0
    
    def _enhanced_count(self, data_list):
        """Enhanced COUNT function"""
        if not isinstance(data_list, (list, tuple)):
            return 1 if data_list is not None else 0
        return len([item for item in data_list if item is not None and item != ''])
    
    def _enhanced_min(self, data_list):
        """Enhanced MIN function"""
        if not isinstance(data_list, (list, tuple)):
            return data_list if data_list is not None else 0
        valid_items = [float(item) for item in data_list 
                      if item is not None and str(item).replace('.','').replace('-','').isdigit()]
        return min(valid_items) if valid_items else 0
    
    def _enhanced_max(self, data_list):
        """Enhanced MAX function"""
        if not isinstance(data_list, (list, tuple)):
            return data_list if data_list is not None else 0
        valid_items = [float(item) for item in data_list 
                      if item is not None and str(item).replace('.','').replace('-','').isdigit()]
        return max(valid_items) if valid_items else 0
    
    def _concatenate(self, *args):
        """CONCATENATE function"""
        result = ''
        for arg in args:
            if arg is not None:
                result += str(arg)
        return result
    
    def _days_between(self, date1, date2):
        """Calculate days between dates"""
        try:
            d1 = frappe.utils.getdate(date1)
            d2 = frappe.utils.getdate(date2)
            return (d2 - d1).days
        except:
            return 0
    
    def _get_current_value(self, field_name):
        """Get value from current document"""
        return self.doc.get(field_name)
    
    def _get_related_value(self, table_name, field_name):
        """Get single related value (placeholder - implement based on relationships)"""
        try:
            # Basic implementation - can be enhanced based on relationship definitions
            return None
        except:
            return None
    
    def _get_child_values(self, table_name, field_name):
        """Get list of values from child records (placeholder)"""
        try:
            # Basic implementation - can be enhanced based on relationship definitions
            return []
        except:
            return []

@frappe.whitelist()
def evaluate_quickbase_formula_api(formula, doctype, doc_name=None):
    """API endpoint to evaluate QuickBase-style formula"""
    try:
        if doc_name:
            doc = frappe.get_doc(doctype, doc_name)
        else:
            doc = frappe.new_doc(doctype)
        
        engine = FlansaFormulaEngine(doc, doctype)
        result = engine.evaluate_quickbase_formula(formula)
        
        return {
            'success': True,
            'result': result
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def validate_quickbase_formula(formula, doctype):
    """Validate QuickBase-style formula"""
    try:
        doc = frappe.new_doc(doctype)
        engine = FlansaFormulaEngine(doc, doctype)
        processed = engine._preprocess_quickbase_formula(formula)
        
        # Basic syntax check
        compile(processed, '<formula>', 'eval')
        
        return {
            'valid': True,
            'message': 'Formula is valid',
            'processed_formula': processed
        }
    except Exception as e:
        return {
            'valid': False,
            'message': str(e)
        }

# Export the main class for easy importing
__all__ = ['FlansaFormulaEngine', 'FormulaField', 'validate_formula', 'get_formula_suggestions', 
           'evaluate_quickbase_formula_api', 'validate_quickbase_formula']

# Main formula engine instance
formula_engine = FlansaFormulaEngine
