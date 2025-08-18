import frappe
import json

class FlansaLogicEngine:
    def __init__(self):
        self.functions = {
            'SUM': lambda *args: sum(float(x or 0) for x in args),
            'IF': lambda condition, true_val, false_val: true_val if condition else false_val,
            'UPPER': lambda s: str(s or '').upper(),
            'LOWER': lambda s: str(s or '').lower(),
            'LINK': lambda doctype: f"LINK_{doctype}",  # Placeholder for Link fields
        }
    
    def evaluate(self, expression, doc_context):
        try:
            # Handle empty expressions (like Link fields)
            if not expression or not expression.strip():
                return None
                
            safe_context = {'doc': frappe._dict(doc_context), '__builtins__': {}, **self.functions}
            python_expr = expression
            for field in doc_context.keys():
                if field in expression:
                    python_expr = python_expr.replace(field, f'doc.get("{field}", 0)')
            return eval(python_expr, safe_context)
        except Exception as e:
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
