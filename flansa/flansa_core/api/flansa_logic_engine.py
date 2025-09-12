import frappe
import json

class FlansaLogicEngine:
    def __init__(self):
        self.functions = {
            'SUM': lambda *args: sum(float(x or 0) for x in args),
            'IF': lambda condition, true_val, false_val: true_val if condition else false_val,
            'UPPER': lambda s: str(s or '').upper(),
            'LOWER': lambda s: str(s or '').lower(),
            'LINK': self.create_link_function(),  # Handle Link fields
        }
    
    def create_link_function(self):
        """Create a LINK function that can access doc_context when called"""
        def link_function(field_or_doctype):
            # Simple implementation - just return the target doctype name
            target_doctype = str(field_or_doctype or "")
            print(f"✅ LINK function - Target DocType: {target_doctype}", flush=True) 
            # For link fields, return a simple identifier
            return f"LINK_TO_{target_doctype}"
        return link_function
    
    def handle_link_function(self, field_or_doctype, doc_context):
        """Handle LINK function calls for Link fields with display functionality"""
        try:
            # The LINK function is used to mark link fields for special display handling
            # field_or_doctype should be the target DocType name as a string
            target_doctype = str(field_or_doctype or "")
            print(f"✅ LINK function - Target DocType: {target_doctype}", flush=True) 
            
            # For link fields, we typically want to return the display value, not the raw ID
            # This is handled by the frontend display logic, so we just return a placeholder
            return f"LINK_TO_{target_doctype}"
            
        except Exception as e:
            print(f"❌ LINK function error: {e}", flush=True)
            return ""
    
    def evaluate(self, expression, doc_context):
        try:
            # Handle empty expressions (like Link fields)
            if not expression or not expression.strip():
                return None
            
            # Debug logging to understand what's in doc_context
            print(f"🔍 FlansaLogic Debug - Expression: {expression}", flush=True)
            print(f"🔍 FlansaLogic Debug - doc_context keys: {list(doc_context.keys())}", flush=True)
            
            # Ensure we have the actual field values in context
            # Create a safe context that includes both field values and functions
            safe_context = {
                '__builtins__': {},
                **self.functions  # Add our custom functions (SUM, IF, etc.)
            }
            
            # Add all field values directly to context (not inside a 'doc' object)
            for field_name, field_value in doc_context.items():
                # Skip date functions and other non-field items
                if not callable(field_value) and field_name not in ['today', 'now', 'add_days', 'add_months', 'date_diff']:
                    safe_context[field_name] = field_value or 0  # Default to 0 for None values
            
            # Also include a doc dict for compatibility
            safe_context['doc'] = frappe._dict(doc_context)
            
            # Debug: Show what fields are available for the expression
            expression_fields = []
            for field_name in safe_context.keys():
                if field_name in expression and field_name != 'doc' and not field_name.startswith('__'):
                    expression_fields.append(f"{field_name}={safe_context[field_name]}")
            
            if expression_fields:
                print(f"✅ FlansaLogic - Available fields: {', '.join(expression_fields)}", flush=True)
            else:
                print(f"⚠️ FlansaLogic - No matching fields found for expression", flush=True)
            
            # Evaluate the expression directly (field names should now resolve)
            result = eval(expression, safe_context)
            print(f"✅ FlansaLogic - Result: {result}", flush=True)
            return result
            
        except Exception as e:
            print(f"❌ FlansaLogic Error - Expression: {expression}", flush=True)
            print(f"❌ FlansaLogic Error - Available fields: {[k for k in doc_context.keys() if not callable(doc_context[k])]}", flush=True)
            frappe.log_error(f"Formula error: {e}")
            return 0

_engine = None
def get_logic_engine():
    global _engine
    if _engine is None:
        _engine = FlansaLogicEngine()
    return _engine

@frappe.whitelist()
def test_logic(expression, sample_data=None):
    try:
        if not sample_data:
            sample_data = {"price": 100, "quantity": 2}
        if isinstance(sample_data, str):
            sample_data = json.loads(sample_data)
        engine = get_logic_engine()
        result = engine.evaluate(expression, sample_data)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
